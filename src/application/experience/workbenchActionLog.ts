/** Bounded lifecycle observations from an action provider; never fabricated by a view. */
export interface WorkbenchActionLogEntry {sequence:number;phase:string;level:'info'|'warning'|'error';message:string}
