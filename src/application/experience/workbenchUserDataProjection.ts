/** Host-declared user/data projection. No credentials or tokens belong in this view. */
export interface WorkbenchUserDataProjection {
 connection: {status:'local'|'authenticated'|'unavailable';label:string;providerLabel?:string};
 dataUses: readonly {id:string;label:string;purpose:string;location:string;retention?:string}[];
 unavailableServices: readonly {id:string;label:string;reason:string}[];
 /** Only actions actually supported by the connected provider are advertised. */
 actions: readonly {id:string;label:string;description:string}[];
}
