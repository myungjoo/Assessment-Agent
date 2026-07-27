import type { UploadedDumpFile } from './uploaded-dump-file';

// UploadedDumpFile 은 순수 타입-only 인터페이스라 런타임 코드가 없다 (ADR-0055 §Decision 4).
// 따라서 본 spec 은 인터페이스에 구조적으로 부합하는 객체를 만들어
//   1) 각 필드의 런타임 타입/형태 (Buffer.isBuffer, typeof string/number) 를 검증하고
//   2) 컴파일 타임 assignability (아래 makeSample 반환 타입) 를 함께 검증한다.
// 이 spec 이 존재해야 scripts/check-spec-presence.sh 의 colocated spec 요구를 충족한다.
describe('UploadedDumpFile', () => {
  // 인터페이스에 부합하는 표본 객체를 만든다. 반환 타입을 UploadedDumpFile 로 못박아
  // 필드 하나라도 빠지거나 타입이 어긋나면 컴파일이 실패하도록 한다 (compile-time contract).
  const makeSample = (): UploadedDumpFile => ({
    buffer: Buffer.from('dump-body', 'utf-8'),
    originalname: 'backup.dump',
    size: 9,
    mimetype: 'application/octet-stream',
  });

  it('buffer 필드는 실제 Buffer 인스턴스여야 한다', () => {
    const file = makeSample();
    // memoryStorage in-memory 본문 — 복원 엔진 파싱 입력 (ADR-0055 §Decision 2).
    expect(Buffer.isBuffer(file.buffer)).toBe(true);
    expect(file.buffer.toString('utf-8')).toBe('dump-body');
  });

  it('originalname / mimetype 은 문자열이어야 한다', () => {
    const file = makeSample();
    expect(typeof file.originalname).toBe('string');
    expect(typeof file.mimetype).toBe('string');
  });

  it('size 는 숫자여야 한다', () => {
    const file = makeSample();
    expect(typeof file.size).toBe('number');
    // 표본의 size 는 buffer byte 길이와 일관되게 둔다 (진단·검증용 메타).
    expect(file.size).toBe(file.buffer.length);
  });

  it('필수 4개 필드를 모두 가지며 그 외 형태 계약을 만족한다', () => {
    const file = makeSample();
    // 구조적 타이핑 — 실 런타임 객체는 더 많은 필드를 가질 수 있으나
    // 인터페이스가 요구하는 최소 4개 필드는 반드시 존재해야 한다.
    expect(Object.keys(file).sort()).toEqual(
      ['buffer', 'mimetype', 'originalname', 'size'].sort(),
    );
  });
});
