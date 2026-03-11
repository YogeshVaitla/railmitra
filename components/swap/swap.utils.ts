import Colors from '../../constants/Colors';
import { SEAT_TYPES, REASONS } from './swap.constants';

export const getSeatTypeLabel = (type: string) => SEAT_TYPES.find(t => t.id === type)?.label || type;

export const getTimeSince = (timestamp: number) => {
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
};

export const getTimeUntilExpiry = (expiresAt: number) => {
    const mins = Math.floor((expiresAt - Date.now()) / 60000);
    if (mins <= 0) return 'Expired';
    if (mins < 60) return `${mins}m left`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
};

export const getReasonEmoji = (r: string) => REASONS.find(x => x.id === r)?.emoji || '💜';

export const getPriorityColor = (score: number) => {
    if (score >= 0.7) return Colors.danger.start;
    if (score >= 0.4) return Colors.warning.start;
    return Colors.success.start;
};
