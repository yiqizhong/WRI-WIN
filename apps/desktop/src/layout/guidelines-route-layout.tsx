import { useOutlet } from "react-router-dom";

export function GuidelinesRouteLayout() {
  const outlet = useOutlet();

  return (
    <div className="audits-route-transition flex h-full min-h-0 flex-col overflow-hidden">
      <div className="audits-route-transition__layer">{outlet}</div>
    </div>
  );
}
