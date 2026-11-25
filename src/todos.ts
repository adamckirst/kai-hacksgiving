export const todoGroups = ['Overdue','Due soon','Later','No date'] as const;
export type Todo = {
  id:string; text:string; due_on:string|null; owner_person_id:string|null;
  person_id:string|null; person_name:string|null; owner_name:string|null;
  quote:string; conversation_id:string; group:typeof todoGroups[number];
};
