// Mock data service that mimics IRCTC chart data
import {
    Train,
    Station,
    Coach,
    Berth,
    TrainClassAvailability,
    TrainClass,
    SearchParams,
} from '../models/types';

// Popular train station data
const STATIONS: Record<string, string> = {
    NDLS: 'New Delhi',
    BCT: 'Mumbai Central',
    HWH: 'Howrah Jn',
    MAS: 'Chennai Central',
    SBC: 'Bangalore City',
    PNBE: 'Patna Jn',
    LKO: 'Lucknow',
    JP: 'Jaipur',
    ADI: 'Ahmedabad',
    BPL: 'Bhopal',
    NGP: 'Nagpur',
    PUNE: 'Pune',
    CNB: 'Kanpur Central',
    AGC: 'Agra Cantt',
    GZB: 'Ghaziabad',
    DDN: 'Dehradun',
    ALD: 'Prayagraj',
    BSB: 'Varanasi',
    MGS: 'Mughal Sarai',
    DHN: 'Dhanbad',
};

// Train database
const TRAIN_DATABASE: Record<
    string,
    {
        name: string;
        type: string;
        classes: TrainClass[];
        route: { code: string; arr?: string; dep?: string; day: number }[];
        days: string[];
    }
> = {
    '12301': {
        name: 'Howrah Rajdhani Express',
        type: 'Rajdhani',
        classes: ['1A', '2A', '3A'],
        route: [
            { code: 'NDLS', dep: '16:55', day: 1 },
            { code: 'CNB', arr: '21:10', dep: '21:15', day: 1 },
            { code: 'ALD', arr: '23:15', dep: '23:20', day: 1 },
            { code: 'MGS', arr: '01:00', dep: '01:05', day: 2 },
            { code: 'DHN', arr: '05:10', dep: '05:15', day: 2 },
            { code: 'HWH', arr: '09:55', day: 2 },
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    '12302': {
        name: 'New Delhi Rajdhani Express',
        type: 'Rajdhani',
        classes: ['1A', '2A', '3A'],
        route: [
            { code: 'HWH', dep: '14:05', day: 1 },
            { code: 'DHN', arr: '17:53', dep: '17:55', day: 1 },
            { code: 'MGS', arr: '22:10', dep: '22:15', day: 1 },
            { code: 'ALD', arr: '23:55', dep: '00:00', day: 2 },
            { code: 'CNB', arr: '02:08', dep: '02:10', day: 2 },
            { code: 'NDLS', arr: '07:55', day: 2 },
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    '12951': {
        name: 'Mumbai Rajdhani Express',
        type: 'Rajdhani',
        classes: ['1A', '2A', '3A'],
        route: [
            { code: 'NDLS', dep: '16:25', day: 1 },
            { code: 'BPL', arr: '23:30', dep: '23:35', day: 1 },
            { code: 'BCT', arr: '08:35', day: 2 },
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    '12259': {
        name: 'Duronto Express',
        type: 'Duronto',
        classes: ['SL', '3A', '2A', '1A'],
        route: [
            { code: 'NDLS', dep: '20:15', day: 1 },
            { code: 'BSB', arr: '06:15', dep: '06:20', day: 2 },
            { code: 'PNBE', arr: '12:30', day: 2 },
        ],
        days: ['Mon', 'Wed', 'Fri', 'Sun'],
    },
    '12003': {
        name: 'Lucknow Swarna Shatabdi',
        type: 'Shatabdi',
        classes: ['CC', 'EC'],
        route: [
            { code: 'NDLS', dep: '06:10', day: 1 },
            { code: 'GZB', arr: '06:42', dep: '06:44', day: 1 },
            { code: 'CNB', arr: '10:15', dep: '10:20', day: 1 },
            { code: 'LKO', arr: '12:40', day: 1 },
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    },
    '12049': {
        name: 'Gatimaan Express',
        type: 'Gatimaan',
        classes: ['CC', 'EC'],
        route: [
            { code: 'NDLS', dep: '08:10', day: 1 },
            { code: 'AGC', arr: '09:50', day: 1 },
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    '12561': {
        name: 'Swatantrata Senani SF Express',
        type: 'Superfast',
        classes: ['SL', '3A', '2A'],
        route: [
            { code: 'NDLS', dep: '14:20', day: 1 },
            { code: 'CNB', arr: '19:10', dep: '19:15', day: 1 },
            { code: 'ALD', arr: '21:30', dep: '21:35', day: 1 },
            { code: 'BSB', arr: '00:05', dep: '00:10', day: 2 },
            { code: 'MGS', arr: '01:10', dep: '01:15', day: 2 },
            { code: 'DHN', arr: '05:40', dep: '05:45', day: 2 },
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    '12723': {
        name: 'Telangana Express',
        type: 'Superfast',
        classes: ['SL', '3A', '2A', '1A'],
        route: [
            { code: 'NDLS', dep: '06:50', day: 1 },
            { code: 'AGC', arr: '09:05', dep: '09:10', day: 1 },
            { code: 'BPL', arr: '16:00', dep: '16:10', day: 1 },
            { code: 'NGP', arr: '23:00', dep: '23:10', day: 1 },
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
};

const BERTH_TYPES_SLEEPER: Berth['berthType'][] = ['LB', 'MB', 'UB', 'SL', 'SU'];
const BERTH_TYPES_AC: Berth['berthType'][] = ['LB', 'UB', 'SL', 'SU'];
const BERTH_TYPES_CHAIR: Berth['berthType'][] = ['LB']; // Window/Aisle seats shown as LB

function generateBerths(
    coachName: string,
    totalBerths: number,
    isAC: boolean,
    route: { code: string }[],
    fromIdx: number,
    toIdx: number
): { vacant: Berth[]; occupied: number } {
    const berths: Berth[] = [];
    const types = isAC ? BERTH_TYPES_AC : BERTH_TYPES_SLEEPER;
    let occupied = 0;

    for (let i = 1; i <= totalBerths; i++) {
        const berthType = types[(i - 1) % types.length];
        // ~30-60% vacancy rate for realistic data
        const isVacant = Math.random() > 0.55;

        if (isVacant) {
            // Some berths might be vacant for the full journey, some for segments
            const segmentStart = Math.random() > 0.3 ? fromIdx : Math.max(fromIdx, Math.floor(Math.random() * route.length));
            const segmentEnd = Math.random() > 0.3 ? toIdx : Math.min(toIdx, segmentStart + 1 + Math.floor(Math.random() * (route.length - segmentStart - 1)));

            berths.push({
                berthNumber: i,
                berthType,
                fromStation: route[segmentStart].code,
                toStation: route[Math.min(segmentEnd, route.length - 1)].code,
                isVacant: true,
                coachName,
            });
        } else {
            occupied++;
        }
    }

    return { vacant: berths, occupied };
}

function generateCoaches(
    cls: TrainClass,
    route: { code: string }[],
    fromIdx: number,
    toIdx: number
): Coach[] {
    const coaches: Coach[] = [];

    let coachPrefix: string;
    let coachCount: number;
    let berthsPerCoach: number;
    let isAC: boolean;

    switch (cls) {
        case '1A':
            coachPrefix = 'H';
            coachCount = 1;
            berthsPerCoach = 18;
            isAC = true;
            break;
        case '2A':
            coachPrefix = 'A';
            coachCount = 3;
            berthsPerCoach = 46;
            isAC = true;
            break;
        case '3A':
            coachPrefix = 'B';
            coachCount = 5;
            berthsPerCoach = 64;
            isAC = true;
            break;
        case 'SL':
            coachPrefix = 'S';
            coachCount = 8;
            berthsPerCoach = 72;
            isAC = false;
            break;
        case 'CC':
            coachPrefix = 'C';
            coachCount = 6;
            berthsPerCoach = 78;
            isAC = true;
            break;
        case 'EC':
            coachPrefix = 'E';
            coachCount = 2;
            berthsPerCoach = 56;
            isAC = true;
            break;
        default:
            coachPrefix = 'G';
            coachCount = 4;
            berthsPerCoach = 72;
            isAC = false;
    }

    for (let i = 1; i <= coachCount; i++) {
        const coachName = `${coachPrefix}${i}`;
        const { vacant, occupied } = generateBerths(
            coachName,
            berthsPerCoach,
            isAC,
            route,
            fromIdx,
            toIdx
        );

        coaches.push({
            coachName,
            coachClass: cls,
            totalBerths: berthsPerCoach,
            vacantBerths: vacant,
            occupiedBerths: occupied,
        });
    }

    return coaches;
}

export function searchTrainAvailability(params: SearchParams): Train | null {
    const trainData = TRAIN_DATABASE[params.trainNumber];
    if (!trainData) return null;

    const route = trainData.route;
    const fromIdx = route.findIndex((s) => s.code === params.fromStation);
    const toIdx = route.findIndex((s) => s.code === params.toStation);

    if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) return null;

    const routeStations: Station[] = route.map((s, idx) => ({
        code: s.code,
        name: STATIONS[s.code] || s.code,
        arrivalTime: s.arr,
        departureTime: s.dep,
        dayCount: s.day,
        stopNumber: idx + 1,
    }));

    const classes: TrainClassAvailability[] = trainData.classes.map((cls) => {
        const coaches = generateCoaches(cls, route, fromIdx, toIdx);
        const totalSeats = coaches.reduce((sum, c) => sum + c.totalBerths, 0);
        const vacantSeats = coaches.reduce((sum, c) => sum + c.vacantBerths.length, 0);

        return {
            className: cls,
            classFullName:
                cls === 'SL'
                    ? 'Sleeper'
                    : cls === '3A'
                        ? 'AC 3 Tier'
                        : cls === '2A'
                            ? 'AC 2 Tier'
                            : cls === '1A'
                                ? 'AC First Class'
                                : cls === 'CC'
                                    ? 'Chair Car'
                                    : cls === 'EC'
                                        ? 'Executive Chair'
                                        : cls,
            totalSeats,
            vacantSeats,
            coaches,
        };
    });

    return {
        trainNumber: params.trainNumber,
        trainName: trainData.name,
        source: routeStations[fromIdx],
        destination: routeStations[toIdx],
        journeyDate: params.journeyDate,
        chartStatus: 'PREPARED',
        chartPreparedAt: '4 hrs ago',
        classes,
        route: routeStations,
        runningDays: trainData.days,
        trainType: trainData.type,
    };
}

export function getTrainSuggestions(query: string): { number: string; name: string }[] {
    if (!query || query.length < 2) return [];

    return Object.entries(TRAIN_DATABASE)
        .filter(
            ([num, data]) =>
                num.includes(query) || data.name.toLowerCase().includes(query.toLowerCase())
        )
        .map(([num, data]) => ({ number: num, name: data.name }))
        .slice(0, 5);
}

export function getStationsForTrain(trainNumber: string): { code: string; name: string }[] {
    const train = TRAIN_DATABASE[trainNumber];
    if (!train) return [];

    return train.route.map((s) => ({
        code: s.code,
        name: STATIONS[s.code] || s.code,
    }));
}

export function getTrainRunningDays(trainNumber: string): string[] | null {
    const trainData = TRAIN_DATABASE[trainNumber];
    if (!trainData) return null;
    return trainData.days;
}

export { STATIONS, TRAIN_DATABASE };
