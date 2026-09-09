import client from './client';

export const raiseException = (payload) => client.post('/exceptions', payload);

export const supervisorOverride = (id, payload) => client.post(`/exceptions/${id}/override`, payload);

export const getExceptionsByBooking = (bookingId) => client.get(`/exceptions/booking/${bookingId}`);

export const getExceptionById = (id) => client.get(`/exceptions/${id}`);
