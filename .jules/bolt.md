## 2024-05-18 - Missing memoization for derived component data
**Learning:** Some components in this app (like InteractivePieChart.tsx) do not use useMemo for heavy calculations such as generating SVG paths and converting data, which re-run on every render.
**Action:** Always wrap derived data calculations in useMemo to prevent unnecessary re-calculations on every render, especially when interacting with state like hovered slices.
