import client from './client';

export const createBooking = (payload) => client.post('/bookings', payload);

export const getMyBookings = () => client.get('/bookings/my');

export const getBookingById = (id) => client.get(`/bookings/${id}`);

export const cancelBooking = (id, reason) => client.post(`/bookings/${id}/cancel`, { reason });
