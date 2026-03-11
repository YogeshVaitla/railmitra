import { SeatType, SwapReason } from '../../services/swapStore';

export const SEAT_TYPES: { id: SeatType; label: string; icon: string }[] = [
    { id: 'LOWER', label: 'Lower', icon: 'bed-outline' },
    { id: 'MIDDLE', label: 'Middle', icon: 'reorder-three-outline' },
    { id: 'UPPER', label: 'Upper', icon: 'arrow-up-outline' },
    { id: 'SIDE_LOWER', label: 'Side Lower', icon: 'bed-outline' },
    { id: 'SIDE_UPPER', label: 'Side Upper', icon: 'arrow-up-outline' },
];

export const REASONS: { id: SwapReason; label: string; emoji: string }[] = [
    { id: 'elderly', label: 'Elderly', emoji: '👴' },
    { id: 'medical', label: 'Medical', emoji: '🏥' },
    { id: 'family', label: 'Family', emoji: '👨‍👩‍👧' },
    { id: 'preference', label: 'Preference', emoji: '💜' },
];
