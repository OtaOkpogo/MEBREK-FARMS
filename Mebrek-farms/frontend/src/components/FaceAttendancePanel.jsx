
import { useCallback, useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";

import {
  enrollWorkerFace,
  removeWorkerFace,
  recognizeWorkerFace,
} from "../services/faceAttendanceService";

const MODEL_URL = "/models";

function getWorkerId(worker) {
  return worker?._id || worker?.id || "";
}

function getWorkerName(worker) {
  return (
    worker?.workerName ||
    [worker?.firstName, worker?.lastName].filter(Boolean).join(" ") ||
    worker?.employeeId ||
    "Unnamed worker"
  );
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

export default function FaceAttendancePanel({
  workers = [],
  onAttendanceRecorded,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const busyRef = useRef(false);

  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState("check-in");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const role = localStorage.getItem("role") || "";
  const isSuperadmin = role.toLowerCase() === "superadmin";

  const activeWorkers = workers.filter(
    (worker) =>
      worker?.status?.toLowerCase() === "active" &&
      getWorkerId(worker)
  );

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        if (!cancelled) {
          setModelsReady(true);
        }
      } catch (loadError) {
        console.error("Face model loading failed:", loadError);

        if (!cancelled) {
          setError(
            "Face models could not load. Check that all six model files exist in frontend/public/models."
          );
        }
      }
    }

    loadModels();

    return () => {
      cancelled = true;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startCamera = async () => {
    setError("");
    setMessage("");

    if (!modelsReady) {
      setError("Please wait for the face recognition models to load.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera access is unavailable. Use HTTPS or localhost and a supported browser."
      );
      return;
    }

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setCameraReady(true);
    } catch (cameraError) {
      console.error("Camera startup failed:", cameraError);

      setError(
        cameraError?.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings."
          : "Unable to start the camera. Check that a camera is connected and not being used by another application."
      );
    }
  };

  const captureDescriptor = async () => {
    const video = videoRef.current;

    if (
      !video ||
      !streamRef.current ||
      video.readyState < 2 ||
      video.videoWidth === 0
    ) {
      throw new Error("The camera is not ready. Start the camera and try again.");
    }

    const result = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5,
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!result) {
      throw new Error(
        "No clear face was detected. Face the camera, improve the lighting, and try again."
      );
    }

    return Array.from(result.descriptor);
  };

  const runRecognition = async () => {
    if (busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const descriptor = await captureDescriptor();

      const result = await recognizeWorkerFace({
        descriptor,
        action,
      });

      setMessage(
        result?.message || "Attendance action processed successfully."
      );

      if (typeof onAttendanceRecorded === "function") {
        await onAttendanceRecorded();
      }
    } catch (recognitionError) {
      setError(getErrorMessage(recognitionError));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const runEnrollment = async () => {
    if (!isSuperadmin) {
      setError("Only a superadmin can enroll worker faces.");
      return;
    }

    if (!selectedWorkerId) {
      setError("Select a worker before enrolling a face.");
      return;
    }

    if (!consentConfirmed) {
      setError(
        "Confirm that the worker has given informed consent before enrollment."
      );
      return;
    }

    if (busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const descriptor = await captureDescriptor();

      const result = await enrollWorkerFace({
        workerId: selectedWorkerId,
        descriptor,
      });

      setMessage(result?.message || "Worker face enrolled successfully.");
      setConsentConfirmed(false);
    } catch (enrollmentError) {
      setError(getErrorMessage(enrollmentError));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const runRemoval = async () => {
    if (!isSuperadmin) {
      setError("Only a superadmin can remove face enrollment.");
      return;
    }

    if (!selectedWorkerId) {
      setError("Select a worker first.");
      return;
    }

    const worker = activeWorkers.find(
      (item) => getWorkerId(item) === selectedWorkerId
    );

    const confirmed = window.confirm(
      `Remove face enrollment for ${getWorkerName(worker)}?`
    );

    if (!confirmed || busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await removeWorkerFace(selectedWorkerId);

      setMessage(result?.message || "Face enrollment removed.");
    } catch (removalError) {
      setError(getErrorMessage(removalError));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          Facial Attendance
        </h2>

        <p className="mt-1 text-sm text-gray-600">
          Use the camera to identify an enrolled worker and record a check-in
          or check-out.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="overflow-hidden rounded-lg bg-gray-950">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full object-cover"
              aria-label="Facial attendance camera preview"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startCamera}
              disabled={!modelsReady || busy || cameraReady}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {modelsReady ? "Start camera" : "Loading face models..."}
            </button>

            <button
              type="button"
              onClick={stopCamera}
              disabled={!cameraReady || busy}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Stop camera
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-500">
            {modelsReady
              ? cameraReady
                ? "Camera is active. Position one face clearly in the frame."
                : "Face recognition models are ready."
              : "Loading local face recognition models..."}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="face-attendance-action"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Attendance action
            </label>

            <select
              id="face-attendance-action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="check-in">Check in</option>
              <option value="check-out">Check out</option>
            </select>
          </div>

          <button
            type="button"
            onClick={runRecognition}
            disabled={!cameraReady || !modelsReady || busy}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Processing..." : "Scan face and record attendance"}
          </button>

          {isSuperadmin && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="font-semibold text-gray-900">
                Manage face enrollment
              </h3>

              <div>
                <label
                  htmlFor="face-worker"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Active worker
                </label>

                <select
                  id="face-worker"
                  value={selectedWorkerId}
                  onChange={(event) =>
                    setSelectedWorkerId(event.target.value)
                  }
                  disabled={busy}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                >
                  <option value="">Select a worker</option>

                  {activeWorkers.map((worker) => (
                    <option
                      key={getWorkerId(worker)}
                      value={getWorkerId(worker)}
                    >
                      {getWorkerName(worker)}
                      {worker.employeeId ? ` (${worker.employeeId})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={consentConfirmed}
                  onChange={(event) =>
                    setConsentConfirmed(event.target.checked)
                  }
                  disabled={busy}
                  className="mt-1"
                />

                <span>
                  The worker has been informed about facial recognition and
                  has given consent to enroll their face template.
                </span>
              </label>

              <button
                type="button"
                onClick={runEnrollment}
                disabled={!cameraReady || !modelsReady || busy}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enroll selected worker
              </button>

              <button
                type="button"
                onClick={runRemoval}
                disabled={!selectedWorkerId || busy}
                className="w-full rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove selected worker&apos;s face enrollment
              </button>
            </div>
          )}

          {message && (
            <div
              role="status"
              className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
            >
              {message}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>Important:</strong> The app sends a facial descriptor to the
        backend, not a saved photograph. This prototype does not yet provide
        reliable liveness detection, so it must not be treated as secure proof
        of identity or used as the sole basis for payroll. Workers must retain
        access to manual attendance.
      </div>
    </section>
  );
}

