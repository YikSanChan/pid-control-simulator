import React, { useState } from "react";
import { Line, YAxis } from "recharts";
import useInterval from "./use-interval";
import { makeStyles } from "@material-ui/core/styles";
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import { compute, PIDController, setpoint } from "./pid-controller";
import StyledLineChart, { ComparePoint, Point } from "./styled-line-chart";

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(2),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  select: {
    minWidth: 166, // such that it aligns with TextFields
  },
  paperText: {
    textAlign: "left",
  },
}));

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

type Mode = "pid" | "linkedin";

function App() {
  // user settings
  const [mode, setMode] = useState<Mode>("pid");
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

  function nextPacingFactor(
    currentPacingFactor: number,
    controlValue: number,
    mode: Mode
  ) {
    if (mode === "pid") {
      // TODO: What constant to use?
      return normalize(currentPacingFactor + controlValue / 10000);
    } else if (mode === "linkedin") {
      return normalize(
        (1 + Math.sign(controlValue) * 0.1) * currentPacingFactor
      );
    } else {
      // Not possible
      return currentPacingFactor;
    }
  }

  function reset() {
    setMode("pid");
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
    const newInput = Math.max(0, 10000 * pacingFactor + noise(1000)); // TODO: noise factor can be a setting
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
    const newPacingFactor = nextPacingFactor(
      pacingFactor,
      newPIDController.controlValue,
      mode
    );
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
            <Typography variant="h4" gutterBottom className={classes.paperText}>
              PID Control Simulator
            </Typography>
            <Typography
              variant="body1"
              gutterBottom
              className={classes.paperText}
            >
              The PID simulator assumes:
              <br />
              (1) 100 periods
              <br />
              (2) Linear forecast
              <br />
              (3) During each period, if pacing factor is set to 1, then roughly
              $10000 (with noise) will be spent. Therefore please set target
              &lt; 1000000
              <br />
              (4) The noise is simply a uniform distribution in [-1000, +1000]
              <br />
              <br />
              It allows:
              <br />
              (1) Set Mode, Kp, Ki, Kd, and Target at the beginning of a
              simulation
              <br />
              (2) Pause the simulation half-way, setup a different target value,
              and start again
              <br />
              (3) Compare the PID-based pacing with the linkedin-paper based
              pacing
              <br />
            </Typography>
            <Box height={30} />
            <Select
              disabled={delay !== null || period > 0}
              className={classes.select}
              value={mode}
              onChange={(e) => {
                const mode = e.target.value as Mode;
                setMode(mode);
                if (mode === "linkedin") {
                  // linkedin paper showcases a special case of PID controller
                  setKp(1);
                  setKi(0);
                  setKd(0);
                }
              }}
            >
              <MenuItem value="pid">PID</MenuItem>
              <MenuItem value="linkedin">LinkedIn</MenuItem>
            </Select>
            <br />
            <TextField
              label="Target"
              value={target}
              disabled={delay !== null}
              type="number"
              onChange={(e) => setTarget(Number(e.target.value))}
            />
            <br />
            <TextField
              label="Kp"
              value={kp}
              disabled={mode === "linkedin" || period > 0}
              type="number"
              onChange={(e) => setKp(Number(e.target.value))}
            />
            <br />
            <TextField
              label="Ki"
              value={ki}
              disabled={mode === "linkedin" || period > 0}
              type="number"
              onChange={(e) => setKi(Number(e.target.value))}
            />
            <br />
            <TextField
              label="Kd"
              value={kd}
              disabled={mode === "linkedin" || period > 0}
              type="number"
              onChange={(e) => setKd(Number(e.target.value))}
            />
            <br />
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
              <Button onClick={reset}>Reset</Button>
            </div>
          </Paper>
        </Grid>

        <Grid item xs={6}>
          <Paper className={classes.paper}>
            <Typography variant="h6" gutterBottom>
              Cumulative Reference vs Actual
            </Typography>
            <StyledLineChart data={plotCumulative} xMax={TOTAL_PERIOD}>
              <YAxis type="number" domain={[0, "auto"]} />
              <Line type="monotone" dataKey="reference" stroke="#8884d8" />
              <Line type="monotone" dataKey="actual" stroke="#82ca9d" />
            </StyledLineChart>

            <Typography variant="h6" gutterBottom>
              Current Reference vs Actual
            </Typography>
            <StyledLineChart data={plotCurrent} xMax={TOTAL_PERIOD}>
              <YAxis type="number" domain={[0, "auto"]} />
              <Line type="monotone" dataKey="reference" stroke="#8884d8" />
              <Line type="monotone" dataKey="actual" stroke="#82ca9d" />
            </StyledLineChart>

            <Typography variant="h6" gutterBottom>
              Pacing Factor
            </Typography>
            <StyledLineChart data={plotPacingFactors} xMax={TOTAL_PERIOD}>
              <YAxis type="number" domain={[0, 1]} />
              <Line type="monotone" dataKey="value" stroke="#8884d8" />
            </StyledLineChart>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default App;
