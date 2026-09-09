import client from './client';

export const getLiveQueue = (centreId) => client.get(`/queue/live/${centreId}`);

export const checkIn = (bookingId) => client.post(`/queue/${bookingId}/check-in`);

export const releaseSlot = (bookingId) => client.post(`/queue/${bookingId}/release`);

export const markEligible = (bookingId) => client.post(`/queue/${bookingId}/mark-eligible`);

export const getPosition = (centreId, bookingId) => client.get(`/queue/${centreId}/position/${bookingId}`);
