import express from 'express'

const register = async (req, res) => {
  res.json({ message: 'Регистрация (заглушка)' });
};

const login = async (req, res) => {
  res.json({ message: 'Вход (заглушка)' });
};

const logout = async (req, res) => {
  res.json({ message: 'Выход (заглушка)' });
};

export { register, login, logout }