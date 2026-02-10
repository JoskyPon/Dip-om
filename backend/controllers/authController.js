import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from 'mssql';


const register = async (req, res) => {
    res.json({ message: 'Регистрация (заглушка)' });
};

const login = async (req, res) => {
    res.json({ message: 'Вход (заглушка)' });
};

const logout = async (req, res) => {
    res.json({ message: 'Выход (заглушка)' });
};

const profile = async (req, res) => {
    res.json({ message: 'Регистрация (заглушка)' });
};

const vehicles = async (req, res) => {
    res.json({ message: 'Вход (заглушка)' });
};

const policies = async (req, res) => {
    res.json({ message: 'Выход (заглушка)' });
};

const appointments = async (req, res) => {
    res.json({ message: 'Выход (заглушка)' });
};



export { register, login, logout, profile, vehicles, policies, appointments }