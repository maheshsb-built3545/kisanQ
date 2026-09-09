import client from './client';

export const getNotificationLog = (bookingId) => client.get(`/notifications/${bookingId}/log`);

export const sendNotification = (payload) => client.post('/notifications/send', payload);

export const retryNotification = (id) => client.post(`/notifications/${id}/retry`);
