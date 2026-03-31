import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div>
      <h1>Welcome to MEBREK FARMS</h1>
      <p>Fresh eggs, quality poultry farming, wet and dry manure.</p>

	<br />

	<Link to="/login">
	  <button>Admin Login</button>
	 </Link>
    </div>
  );
}
