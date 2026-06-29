import { AlertsManager } from "../components/AlertsManager";

/** Global alerts dashboard — every alert across all instruments. */
export default function Alerts() {
  return (
    <div>
      <h2>Alerts</h2>
      <AlertsManager />
    </div>
  );
}
