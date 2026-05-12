export default function Unauthorized() {

  return (

    <div
      className="
        min-h-screen
        flex
        items-center
        justify-center
        bg-gray-100
      "
    >

      <div
        className="
          bg-white
          shadow-xl
          rounded-2xl
          p-10
          text-center
        "
      >

        <h1
          className="
            text-5xl
            font-bold
            text-red-500
            mb-4
          "
        >
          Access Denied
        </h1>

        <p className="text-gray-600">
          You do not have permission
          to access this page.
        </p>

      </div>

    </div>
  );
}
