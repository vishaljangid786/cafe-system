const getSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_ENABLE_SOCKET === 'false') {
    return null;
  }

  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URI || 'http://localhost:5000/api';

  if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    return apiUrl.replace(/\/api\/?$/, '');
  }

  return null;
};

export default getSocketUrl;
