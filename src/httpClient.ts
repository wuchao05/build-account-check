import axios from 'axios';

export const httpClient = axios.create({
  timeout: 20_000
});
