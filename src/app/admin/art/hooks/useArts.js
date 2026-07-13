// hooks/useArts.js
import { useState, useEffect } from 'react';
import { FIREBASE_URL } from '../utils/irebase';

export default function useArts() {
  const [arts, setArts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchArts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${FIREBASE_URL}/ART-MAILS/arts.json`);
      const data = await res.json();
      if (data) {
        const artsList = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
        setArts(artsList);
      } else {
        setArts([]);
      }
    } catch (error) {
      console.error('Error fetching ARTs:', error);
      setArts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArts();
  }, []);

  const addArt = async (artData) => {
    try {
      const res = await fetch(`${FIREBASE_URL}/ART-MAILS/arts.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(artData),
      });
      const data = await res.json();
      await fetchArts(); // recargar
      return data;
    } catch (error) {
      console.error('Error adding ART:', error);
      throw error;
    }
  };

  const updateArt = async (id, artData) => {
    try {
      await fetch(`${FIREBASE_URL}/ART-MAILS/arts/${id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(artData),
      });
      await fetchArts();
    } catch (error) {
      console.error('Error updating ART:', error);
      throw error;
    }
  };

  const deleteArt = async (id) => {
    try {
      await fetch(`${FIREBASE_URL}/ART-MAILS/arts/${id}.json`, {
        method: 'DELETE',
      });
      await fetchArts();
    } catch (error) {
      console.error('Error deleting ART:', error);
      throw error;
    }
  };

  return { arts, loading, addArt, updateArt, deleteArt, refetch: fetchArts };
}