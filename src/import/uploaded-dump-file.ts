// UploadedDumpFile — multipart 로 업로드된 dump artifact 파일의 zero-dep local 타입
// (ADR-0055 §Decision 4). `@nestjs/platform-express` (multer bundled) 의
// `@UploadedFile()` 가 넘기는 파일 객체 중 복원 엔진이 실제로 소비하는 최소 필드만
// 담는다 — `@types/multer` 를 새 devDependency 로 추가하지 않기 위한 default 선택
// (CLAUDE.md §5 새 dependency 게이트 미발화, ADR-0055 §Decision 4).
//
// 필드 범위 (좁게 유지 — 넓어지면 ADR-0055 §Decision 4 의 @types/multer 게이트 재소환):
//   - buffer — memoryStorage in-memory 본문 (ADR-0055 §Decision 2). 복원 엔진의
//     파싱 입력. 본 slice (T-1252) 는 수신만 하고 소비하지 않는다 (§Follow-up b).
//   - originalname / size / mimetype — 진단·검증용 메타 (크기 제한 §Follow-up c 에서 활용).
//
// 본 타입은 multer 의 `Express.Multer.File` 전 필드를 끌어오지 않고 구조적으로
// 부분 대응만 한다 (structural typing — 실 런타임 객체는 더 많은 필드를 가질 수 있음).
export interface UploadedDumpFile {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
}
