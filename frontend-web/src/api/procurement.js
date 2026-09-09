import client from './client';

export const recordInspection = (payload) => client.post('/procurement/inspection', payload);

export const recordWeight = (payload) => client.post('/procurement/weight', payload);
