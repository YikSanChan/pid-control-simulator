import React, { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useInterval from "./use-interval";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Grid from "@material-ui/core/Grid";
import { Button, TextField } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(2),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
}));

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
    if (period >= TOTAL_PERIOD) {
      setDelay(null);
    } else {
      tunePid();
    }
  }, delay);

  const classes = useStyles();

  return (
    <div className={classes.root}>
      <Grid container spacing={1}>
        <Grid item xs={3}>
          <Paper className={classes.paper}>
            <TextField
              label="Kp"
              value={kp}
              disabled={period > 0}
              type="number"
              onChange={(e) => setKp(Number(e.target.value))}
            />
            <TextField
              label="Ki"
              value={ki}
              disabled={period > 0}
              type="number"
              onChange={(e) => setKi(Number(e.target.value))}
            />
            <TextField
              label="Kd"
              value={kd}
              disabled={period > 0}
              type="number"
              onChange={(e) => setKd(Number(e.target.value))}
            />
            <TextField
              label="Target"
              value={target}
              disabled={delay !== null}
              type="number"
              onChange={(e) => setTarget(Number(e.target.value))}
            />

            <div>
              {delay ? (
                <Button onClick={() => setDelay(null)}>Stop</Button>
              ) : (
                <Button
                  onClick={() => setDelay(INTERVAL)}
                  disabled={period === TOTAL_PERIOD}
                >
                  Start
                </Button>
              )}
              <Button onClick={() => reset()}>Reset</Button>
            </div>
          </Paper>
        </Grid>

        <Grid item xs={6}>
          <Paper className={classes.paper}>
            <h3>Cumulative Reference vs Actual</h3>
            <ResponsiveContainer aspect={3}>
              <LineChart
                data={plotCumulative}
                margin={{ left: 20, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="period"
                  label={{
                    value: "Period",
                    position: "insideBottomRight",
                    dy: 10,
                  }}
                  domain={[0, TOTAL_PERIOD]}
                />
                <YAxis type="number" domain={[0, "auto"]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="reference" stroke="#8884d8" />
                <Line type="monotone" dataKey="actual" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>

            <h3>Current Reference vs Actual</h3>
            <ResponsiveContainer aspect={3}>
              <LineChart
                data={plotCurrent}
                margin={{ left: 20, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="period"
                  label={{
                    value: "Period",
                    position: "insideBottomRight",
                    dy: 10,
                  }}
                  domain={[0, TOTAL_PERIOD]}
                />
                <YAxis type="number" domain={[0, "auto"]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="reference" stroke="#8884d8" />
                <Line type="monotone" dataKey="actual" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>

            <h3>Pacing Factor</h3>
            <ResponsiveContainer aspect={3}>
              <LineChart
                data={plotPacingFactors}
                margin={{ left: 20, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="period"
                  label={{
                    value: "Period",
                    position: "insideBottomRight",
                    dy: 10,
                  }}
                  domain={[0, TOTAL_PERIOD]}
                />
                <YAxis type="number" domain={[0, 1]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default App;
