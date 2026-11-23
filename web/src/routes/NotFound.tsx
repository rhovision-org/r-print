import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div>
      <h1>Not found</h1>
      <p className="muted">
        No such route. This client has no search or indexer; links come from the catalogue or
        from a publication.
      </p>
      <Link to="/">Back to the catalogue</Link>
    </div>
  );
}
