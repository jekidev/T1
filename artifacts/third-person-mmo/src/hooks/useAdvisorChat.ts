import { useMutation } from '@tanstack/react-query';
import { advisorChat, type AdvisorResponse } from '../lib/api';

export function useAdvisorChat() {
  return useMutation<AdvisorResponse, Error, { role: string; message: string; board: Record<string, unknown> }>({
    mutationFn: ({ role, message, board }) => advisorChat(role, message, board),
  });
}
