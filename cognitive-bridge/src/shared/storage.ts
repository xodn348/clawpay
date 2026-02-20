export async function getStorage(key: string): Promise<unknown> {
  const result = await chrome.storage.local.get(key);
  return result[key];
}

export async function setStorage(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}
