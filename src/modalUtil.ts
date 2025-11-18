export interface TextareaModalOptions {
  title: string;
  initialValue: string;
  saveButtonLabel?: string;
  maxWidth?: string;
  minHeight?: string;
  fontSize?: string;
  onSave: (value: string) => void;
  onModalStateChange: (isOpen: boolean) => void;
}

export function showTextareaModal(options: TextareaModalOptions): void {
  const {
    title,
    initialValue,
    saveButtonLabel = 'Save',
    maxWidth = '600px',
    minHeight = '300px',
    fontSize = '14px',
    onSave,
    onModalStateChange,
  } = options;

  // Set modal open flag
  onModalStateChange(true);

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'textarea-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 8px;
    max-width: ${maxWidth};
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  `;

  const titleElement = document.createElement('h2');
  titleElement.textContent = title;
  titleElement.style.marginTop = '0';

  const textarea = document.createElement('textarea');
  textarea.value = initialValue;
  textarea.style.cssText = `
    width: 100%;
    min-height: ${minHeight};
    font-family: monospace;
    font-size: ${fontSize};
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    resize: vertical;
    flex: 1;
  `;

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  `;

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    padding: 8px 16px;
    cursor: pointer;
    background: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 4px;
  `;

  const saveBtn = document.createElement('button');
  saveBtn.textContent = saveButtonLabel;
  saveBtn.style.cssText = `
    padding: 8px 16px;
    cursor: pointer;
    background: #007bff;
    color: white;
    border: 1px solid #007bff;
    border-radius: 4px;
  `;

  const closeModal = () => {
    onModalStateChange(false);
    document.body.removeChild(modal);
    document.removeEventListener('keydown', handleKeyDown);
  };

  cancelBtn.onclick = closeModal;

  saveBtn.onclick = () => {
    onSave(textarea.value);
    closeModal();
  };

  // Close modal on Escape key, save on Shift+Enter
  const handleKeyDown = (e: KeyboardEvent) => {
    const shiftEnter = e.key === 'Enter' && e.shiftKey;
    const cmdEnter = e.key === 'Enter' && e.metaKey;
    if (e.key === 'Escape') {
      closeModal();
    } else if (shiftEnter || cmdEnter) {
      e.preventDefault();
      onSave(textarea.value);
      closeModal();
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(saveBtn);

  modalContent.appendChild(titleElement);
  modalContent.appendChild(textarea);
  modalContent.appendChild(buttonContainer);

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Focus textarea and select all
  textarea.focus();
  textarea.select();
}
