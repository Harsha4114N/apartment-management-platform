import { Navigate } from 'react-router-dom';

/**
 * Route guard that checks for authentication and optionally enforces role-based access.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - The component to render if authorized.
 * @param {'SuperAdmin'|'Admin'|'Resident'} [props.requiredRole] - If provided, only users
 *   whose role matches (or is a member of an allowed set) can access.
 *   Pass an array for multiple allowed roles, e.g. ['SuperAdmin', 'Admin'].
 * @param {string[]} [props.allowedRoles] - Alternative: explicit array of allowed roles.
 * @param {string} [props.redirectTo='/'] - Where to send unauthorized users.
 */
export default function ProtectedRoute({
  children,
  requiredRole,
  allowedRoles,
  redirectTo = '/',
}) {
  let user;
  try {
    user = JSON.parse(localStorage.getItem('user'));
  } catch {
    user = null;
  }
  const token = localStorage.getItem('token');

  // Not authenticated → redirect to login
  if (!token || !user) {
    return <Navigate to={redirectTo} replace />;
  }

  // Role check
  const rolesToCheck = allowedRoles || (requiredRole ? [requiredRole] : null);
  if (rolesToCheck && rolesToCheck.length > 0) {
    if (!rolesToCheck.includes(user.role)) {
      // Role mismatch — redirect to their correct dashboard
      if (user.role === 'SuperAdmin' || user.role === 'Admin') {
        return <Navigate to="/admin-dashboard" replace />;
      }
      if (user.role === 'Security') {
        return <Navigate to="/security-dashboard" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}
