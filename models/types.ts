// Train data model
export interface Station {
    code: string;
    name: string;
    arrivalTime?: string;
    departureTime?: string;
    dayCount?: number; // Day 1, Day 2, etc.
    distanceFromSource?: number;
    stopNumber: number;
}

export interface Berth {
    berthNumber: number;
    berthType: 'LB' | 'MB' | 'UB' | 'SL' | 'SU'; // Lower, Middle, Upper, Side Lower, Side Upper
    fromStation: string;
    toStation: string;
    isVacant: boolean;
    coachName: string;
}

export interface Coach {
    coachName: string; // e.g., B1, B2, A1, S1
    coachClass: TrainClass;
    totalBerths: number;
    vacantBerths: Berth[];
    occupiedBerths: number;
}

export type TrainClass = 'SL' | '3A' | '2A' | '1A' | 'CC' | 'EC' | '2S' | 'FC';

export interface TrainClassAvailability {
    className: TrainClass;
    classFullName: string;
    totalSeats: number;
    vacantSeats: number;
    coaches: Coach[];
}

export interface Train {
    trainNumber: string;
    trainName: string;
    source: Station;
    destination: Station;
    journeyDate: string;
    chartStatus: 'PREPARED' | 'NOT_PREPARED' | 'VOID';
    chartPreparedAt?: string;
    classes: TrainClassAvailability[];
    route: Station[];
    runningDays: string[]; // e.g., ['Mon', 'Wed', 'Fri']
    trainType: string; // Rajdhani, Shatabdi, Superfast, etc.
}

export interface SearchParams {
    trainNumber: string;
    journeyDate: string;
    fromStation: string;
    toStation: string;
}

export interface FavoriteSearch {
    id: string;
    trainNumber: string;
    trainName: string;
    fromStation: string;
    fromStationName: string;
    toStation: string;
    toStationName: string;
    savedAt: string;
}

// Helper to get full berth type name
export const getBerthTypeName = (type: Berth['berthType']): string => {
    const names: Record<string, string> = {
        LB: 'Lower Berth',
        MB: 'Middle Berth',
        UB: 'Upper Berth',
        SL: 'Side Lower',
        SU: 'Side Upper',
    };
    return names[type] || type;
};

// Helper to get class full name
export const getClassFullName = (cls: TrainClass): string => {
    const names: Record<string, string> = {
        SL: 'Sleeper',
        '3A': 'AC 3 Tier',
        '2A': 'AC 2 Tier',
        '1A': 'AC First Class',
        CC: 'Chair Car',
        EC: 'Executive Chair',
        '2S': 'Second Sitting',
        FC: 'First Class',
    };
    return names[cls] || cls;
};
