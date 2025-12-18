import { Navigate, useLocation } from "react-router-dom";

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

  if (!token) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default RequireAuth;