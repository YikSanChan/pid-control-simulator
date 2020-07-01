import React from "react";
import {
  CartesianGrid,
  Legend,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

export interface ComparePoint {
  period: number;
  reference: number;
  actual: number;
}

export interface Point {
  period: number;
  value: number;
}

interface StyledLineChartProps {
  data: ComparePoint[] | Point[];
  xMax: number;
}

const StyledLineChart: React.FC<StyledLineChartProps> = ({
  data,
  xMax,
  children,
}) => {
  return (
    <ResponsiveContainer aspect={3}>
      <LineChart data={data} margin={{ left: 20, top: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="period"
          label={{
            value: "Period",
            position: "insideBottomRight",
            dy: 10,
          }}
          domain={[0, xMax]}
        />
        <Tooltip />
        <Legend />
        {children}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default StyledLineChart;
