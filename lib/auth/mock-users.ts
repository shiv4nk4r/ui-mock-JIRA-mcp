import type { User } from "@lib/types";

export const MOCK_USERS: User[] = [
  {
    id: "user-external-1",
    email: "pm@partner.com",
    name: "Jasmine",
    role: "external",
    avatarUrl: undefined,
  },
  {
    id: "user-internal-1",
    email: "engineer@greyorange.com",
    name: "Shivankar Sharma",
    role: "internal",
    avatarUrl: undefined,
  },
];

export function getMockUser(id: string): User | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}
