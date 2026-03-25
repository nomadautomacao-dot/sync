export interface FundebData {
    id: string;
    municipio: string;
    uf: string | null;
    ano: number;
    vaaf: number;
    vaat: number;
    vaar: number;
    total: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface FundebEvolution {
    municipio: string;
    preBaseYear: number;
    baseYear: number;
    targetYear: number;
    dataPreBase: FundebData | null;
    dataBase: FundebData | null;
    dataTarget: FundebData | null;
    preDeltas: {
        vaaf: number;
        vaat: number;
        vaar: number;
        total: number;
    };
    deltas: {
        vaaf: number;
        vaat: number;
        vaar: number;
        total: number;
    };
}
