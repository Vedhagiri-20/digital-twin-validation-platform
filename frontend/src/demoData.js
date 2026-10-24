export const product = {
  code: "DT-100",
  name: "Precision Motion Stage Assembly",
  description:
    "Educational sample representing an electromechanical subsystem used to demonstrate Digital Twin and PLM data validation.",
};

export const engineeringParts = [
  { partNumber: "MOTOR-001", name: "Servo Motor", revision: "C", quantity: 1, lifecycle: "RELEASED" },
  { partNumber: "STAGE-002", name: "Linear Stage", revision: "B", quantity: 1, lifecycle: "RELEASED" },
  { partNumber: "BEARING-004", name: "Precision Bearing", revision: "B", quantity: 2, lifecycle: "RELEASED" },
  { partNumber: "SENSOR-007", name: "Position Sensor", revision: "A", quantity: 1, lifecycle: "RELEASED" },
  { partNumber: "CABLE-011", name: "Feedback Cable", revision: "A", quantity: 1, lifecycle: "RELEASED" },
];

export const plmParts = [
  { partNumber: "MOTOR-001", name: "Servo Motor", revision: "B", quantity: 1, lifecycle: "RELEASED" },
  { partNumber: "STAGE-002", name: "Linear Stage", revision: "B", quantity: 1, lifecycle: "RELEASED" },
  { partNumber: "BEARING-004", name: "Precision Bearing", revision: "B", quantity: 1, lifecycle: "RELEASED" },
  { partNumber: "SENSOR-007", name: "Position Sensor", revision: "A", quantity: 1, lifecycle: "IN_REVIEW" },
];

export const engineeringChange = {
  id: "ECO-1024",
  partNumber: "MOTOR-001",
  fromRevision: "B",
  toRevision: "C",
  reason: "Thermal performance improvement",
  status: "APPROVED",
};
