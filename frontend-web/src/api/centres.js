import client from './client';

export const getAllCentres = (params) => client.get('/centres', { params });

export const getCentreById = (id) => client.get(`/centres/${id}`);

export const getCentreAvailability = (id, params) => client.get(`/centres/${id}/availability`, { params });
