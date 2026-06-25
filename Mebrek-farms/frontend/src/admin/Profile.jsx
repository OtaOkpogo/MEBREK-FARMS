export default function Profile() {
  const user = JSON.parse(
    localStorage.getItem("user") || "{}"
  );

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h1 className="text-2xl font-bold mb-6">
        My Profile
      </h1>

      <div className="space-y-4">
        <div>
          <label className="font-semibold">
            Name
          </label>

          <p>{user.name}</p>
        </div>

        <div>
          <label className="font-semibold">
            Email
          </label>

          <p>{user.email}</p>
        </div>

        <div>
          <label className="font-semibold">
            Role
          </label>

          <p>{user.role}</p>
        </div>

        <div>
          <label className="font-semibold">
            Status
          </label>

          <p>{user.status}</p>
        </div>
      </div>
    </div>
  );
}
