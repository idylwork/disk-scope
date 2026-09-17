import { Button } from "./Button";
import styles from "./AccessPrompt.module.css";

type AccessPromptProps = {
  modalOpen: boolean;
  onOpenSettings: () => void;
  onSkip: () => void;
};

/**
 * フルディスクアクセス未許可時の案内
 * @param props
 * @returns
 */
export function AccessPrompt({
  modalOpen,
  onOpenSettings,
  onSkip,
}: AccessPromptProps) {
  return (
    <div className={styles.root}>
      <div className={styles.banner}>
        <div className={styles.bannerText}>
          フォルダごとの確認を出さないため、フルディスクアクセスを許可してください。
        </div>
        <div className={styles.actions}>
          <Button variant="primary" onClick={onOpenSettings}>
            設定を開く
          </Button>
          <Button onClick={onSkip}>スキップ</Button>
        </div>
      </div>
      {modalOpen ? (
        <div className={styles.dialogBackdrop} role="presentation">
          <div className={styles.dialog} role="dialog" aria-modal="true">
            <h2>走査の前にフルディスクアクセス</h2>
            <p>
              macOS
              は書類・デスクトップなどをフォルダ単位で確認します。システム設定で
              Disk Scope をオンにすると、一括で読み取りできます。
            </p>
            <div className={styles.dialogActions}>
              <Button onClick={onSkip}>スキップ</Button>
              <Button variant="primary" onClick={onOpenSettings}>
                設定を開く
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
