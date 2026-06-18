// Short, collision-resistant id for Cells and Lessons. Random suffix + time tail.
export const uid = (): string =>
  "id-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
