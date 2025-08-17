import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
      <Link to="/" className="text-brand-primary underline">
        Return Home
      </Link>
    </div>
  );
}
