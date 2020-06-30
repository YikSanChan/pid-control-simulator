import React, { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useInterval from "./use-interval";
import "./App.css";

interface PIDController {
  kp: number;
  ki: number;
  kd: number;
  lastSetpoint: number;
  sumError: number;
  lastError: number;
  controlValue: number;
}

function compute(c: PIDController, input: number): PIDController {
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

function setpoint(c: PIDController, v: number): PIDController {
  return {
    ...c,
    lastSetpoint: v,
  };
}

// Pacing factor should be within [0, 1]
function normalize(v: number) {
  if (v > 1) return 1;
  else if (v < 0) return 0;
  return v;
}

function noise(v: number) {
  const n = Math.floor(Math.random() * v) + 1;
  if (Math.random() > 0.5) {
    return n;
  } else {
    return -n;
  }
}

const TOTAL_PERIOD = 100;
const INTERVAL = 100;

interface ComparePoint {
  period: number;
  reference: number;
  actual: number;
}

interface Point {
  period: number;
  value: number;
}

// Fix today's budget and assume a linear forecast
function App() {
  // user settings
  const [delay, setDelay] = useState<number | null>(null);
  const [kp, setKp] = useState<number>(1);
  const [ki, setKi] = useState<number>(0);
  const [kd, setKd] = useState<number>(0);
  const [target, setTarget] = useState<number>(800000);

  // Temp variables
  const [period, setPeriod] = useState<number>(0);
  const [pacingFactor, setPacingFactor] = useState<number>(0.1);
  const [sumInput, setSumInput] = useState<number>(0);
  const [pidController, setPIDController] = useState<PIDController>({
    kp,
    ki,
    kd,
    lastSetpoint: 6000, // TODO: just use a reasonable default should be fine?
    sumError: 0,
    lastError: 0,
    controlValue: 0,
  });

  // Data for plotting
  const [plotCurrent, setPlotCurrent] = useState<ComparePoint[]>([]);
  const [plotCumulative, setPlotCumulative] = useState<ComparePoint[]>([]);
  const [plotPacingFactors, setPlotPacingFactors] = useState<Point[]>([]);

  function reset() {
    setDelay(null);
    setKp(1);
    setKi(0);
    setKd(0);
    setTarget(800000);
    setPeriod(0);
    setPacingFactor(0.1);
    setSumInput(0);
    setPIDController({
      kp: 1,
      ki: 0,
      kd: 0,
      lastSetpoint: 6000, // TODO: just use a reasonable default should be fine?
      sumError: 0,
      lastError: 0,
      controlValue: 0,
    });
    setPlotCurrent([]);
    setPlotCumulative([]);
    setPlotPacingFactors([]);
  }

  function tunePid() {
    const newPeriod = period + 1;

    // Current
    const newInput = 10000 * pacingFactor + noise(1000); // add random factor. TODO: noise factor can be a setting
    const newSumInput = sumInput + newInput;

    setPlotCurrent([
      ...plotCurrent,
      {
        period: newPeriod,
        reference: pidController.lastSetpoint,
        actual: newInput,
      },
    ]);

    // Cumulative
    let newPIDController = compute(pidController, newInput);
    const newPacingFactor = normalize(
      pacingFactor + newPIDController.controlValue / 10000
    ); // TODO: /C
    const cumulativeReference = (target * newPeriod) / TOTAL_PERIOD;
    const newSetpoint = Math.max(
      0,
      (target - newSumInput) / (TOTAL_PERIOD - newPeriod)
    );
    newPIDController = setpoint(newPIDController, newSetpoint);

    setPlotCumulative([
      ...plotCumulative,
      {
        period: newPeriod,
        reference: cumulativeReference,
        actual: newSumInput,
      },
    ]);

    setPeriod(newPeriod);
    setPacingFactor(newPacingFactor);
    setSumInput(newSumInput);
    setPIDController(newPIDController);
    setPlotPacingFactors([
      ...plotPacingFactors,
      { period: newPeriod, value: newPacingFactor },
    ]);
  }

  useInterval(() => {
    // if (period === 0) {
    //   setPlotCurrent([{ period: 0, reference: 0, actual: 0 }]);
    //   setPlotCumulative([{ period: 0, reference: 0, actual: 0 }]);
    //   setPlotPacingFactors([{ period: 0, value: 0.1 }]); // TODO: use initial value
    // }
    if (period >= TOTAL_PERIOD) {
      setDelay(null);
    } else {
      tunePid();
    }
  }, delay);

  return (
    <div>
      <div>
        <label>
          Kp:
          <input
            type="number"
            value={kp}
            onChange={(e) => setKp(Number(e.target.value))}
            disabled={period > 0}
          />
        </label>
      </div>

      <div>
        <label>
          Ki:
          <input
            type="number"
            value={ki}
            onChange={(e) => setKi(Number(e.target.value))}
            disabled={period > 0}
          />
        </label>
      </div>

      <div>
        <label>
          Kd:
          <input
            type="number"
            value={kd}
            onChange={(e) => setKd(Number(e.target.value))}
            disabled={period > 0}
          />
        </label>
      </div>

      <div>
        <label>
          Target:
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            disabled={delay !== null}
          />
        </label>
      </div>

      <div>
        {delay ? (
          <button onClick={() => setDelay(null)}>Stop</button>
        ) : (
          <button
            onClick={() => setDelay(INTERVAL)}
            disabled={period === TOTAL_PERIOD}
          >
            Start
          </button>
        )}
        <button onClick={() => reset()}>Reset</button>
      </div>

      <div className="plot-container">
        <h3>Accumulated Reference vs Actual</h3>
        <LineChart
          className="plot"
          width={1000}
          height={250}
          data={plotCumulative}
          margin={{ left: 20, top: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="period"
            label={{ value: "Period", position: "insideBottomRight", dy: 10 }}
            domain={[0, TOTAL_PERIOD]}
          />
          <YAxis type="number" domain={[0, "auto"]} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="reference" stroke="#8884d8" />
          <Line type="monotone" dataKey="actual" stroke="#82ca9d" />
        </LineChart>

        <h3>Current Reference vs Actual</h3>
        <LineChart
          className="plot"
          width={1000}
          height={250}
          data={plotCurrent}
          margin={{ left: 20, top: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="period"
            label={{ value: "Period", position: "insideBottomRight", dy: 10 }}
            domain={[0, TOTAL_PERIOD]}
          />
          <YAxis type="number" domain={[0, "auto"]} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="reference" stroke="#8884d8" />
          <Line type="monotone" dataKey="actual" stroke="#82ca9d" />
        </LineChart>

        <h3>Pacing Factor</h3>
        <LineChart
          className="plot"
          width={1000}
          height={250}
          data={plotPacingFactors}
          margin={{ left: 20, top: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="period"
            label={{ value: "Period", position: "insideBottomRight", dy: 10 }}
            domain={[0, TOTAL_PERIOD]}
          />
          <YAxis type="number" domain={[0, 1]} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="value" stroke="#8884d8" />
        </LineChart>
      </div>
    </div>
  );
}

export default App;
