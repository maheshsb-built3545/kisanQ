import client from './client';

export const requestFarmerOtp = (phone) => client.post('/auth/farmer/request-otp', { phone });

export const verifyFarmerOtp = (phone, otp) => client.post('/auth/farmer/verify-otp', { phone, otp });

export const staffLogin = (name, password, role) => client.post('/auth/staff/login', { name, password, role });

export const staffRegister = (name, password, role, centreId) => client.post('/auth/staff/register', { name, password, role, centreId });

export const getMe = () => client.get('/auth/me');
