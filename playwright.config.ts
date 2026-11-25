import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/phone', workers:1, use:{baseURL:'http://127.0.0.1:18520',viewport:{width:375,height:812}}});
