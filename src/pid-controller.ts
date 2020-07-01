export interface PIDController {
  kp: number;
  ki: number;
  kd: number;
  lastSetpoint: number;
  sumError: number;
  lastError: number;
  controlValue: number;
}

export function compute(c: PIDController, input: number): PIDController {
  const error = c.lastSetpoint - input;
  const sumError = c.sumError + error;
  const dError = error - c.lastError;
  return {
    ...c,
    sumError,
    lastError: error,
    controlValue: c.kp * error + c.ki * sumError + c.kd * dError,
  };
}

export function setpoint(c: PIDController, v: number): PIDController {
  return {
    ...c,
    lastSetpoint: v,
  };
}
