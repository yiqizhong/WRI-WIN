export const WRITER_MODAL_HOST_ID = "writer-modal-host";

export function resolveWriterModalHost(): HTMLElement {
  return document.getElementById(WRITER_MODAL_HOST_ID) ?? document.body;
}
