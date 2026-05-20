import { revalidatePath } from "next/cache";

export function revalidateTrainingCasePaths(caseId: string) {
  revalidatePath(`/academy/cases/${caseId}`);
  revalidatePath(`/academy/cases/${caseId}/edit`);
  revalidatePath(`/academy/training-cases/${caseId}`);
  revalidatePath(`/academy/training-cases/${caseId}/review`);
  revalidatePath("/academy/training-cases");
  revalidatePath("/academy/dashboard");
}
