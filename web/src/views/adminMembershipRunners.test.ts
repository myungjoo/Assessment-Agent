import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';

// R-112 — T-1874 순수 추출로 신설된 모듈의 **경계 spec**. runRemove · runAdd 의 backend 계약 대조
// (route/method/body 축) 는 이미 AdminView.group-member-remove-contract.test.ts ·
// AdminView.group-member-add-contract.test.ts 가 `from './AdminView'` 경로로 cover 하고 있어
// 여기서 그것을 복제하지 않는다. 본 파일이 검증하는 것은 그 spec 들이 볼 수 없는 **새 모듈 자신의
// 공개 표면** 이다 — 즉 (a) 값 · 타입 심볼이 새 모듈에서 직접 import 되는가, (b) AdminView 재수출을
// 거치지 않은 직접 import 경로에서도 두 러너의 정상 / 실패 / 미발사 / finally 계약이 같은가,
// (c) 재수출본과 직접 import 본이 **동일 함수 참조** 인가(기존 계약 spec 들의 위임 검증이 이동 후에도
// 계속 유효함의 근거). 이동 전에는 존재할 수 없던 검증이라 기존 spec 과 중복이 아니다
// (adminUserMutationRunners.test.ts · adminScheduleRunners.test.ts 선례 동형).
import { runAdd, runRemove } from './adminMembershipRunners';
import type { AddDeps, RemoveDeps } from './adminMembershipRunners';
import {
  runAdd as reexportedRunAdd,
  runRemove as reexportedRunRemove,
} from './AdminView';

const GROUP_ID = 'g-1';
const MEMBERSHIP_ID = 'm-1';
const PERSON_ID = 'p-1';

// 발사 기록 1 건 — 러너가 primitive 에 넘긴 path 와 options 를 그대로 보관한다.
interface Fire {
  path: string;
  options: RequestOptions;
}

// 상태 전이 관측 기록 — setter 로 흘러든 값의 시간 순서를 그대로 담는다(전이 순서가 계약).
interface Recorder {
  fires: Fire[];
  progress: boolean[];
  errors: (string | undefined)[];
  refreshCount: number;
  resetCount: number;
}

function newRecorder(): Recorder {
  return {
    fires: [],
    progress: [],
    errors: [],
    refreshCount: 0,
    resetCount: 0,
  };
}

// runRemove 용 deps 조립 — 발사 primitive 의 동작(성공/실패)과 초기 가드 값만 인자로 받는다.
function makeRemoveDeps(
  rec: Recorder,
  options: {
    removing?: boolean;
    groupId?: string;
    fail?: unknown;
    onFire?: () => void;
  } = {},
): RemoveDeps {
  return {
    remove: async (path, requestOptions) => {
      rec.fires.push({ path, options: requestOptions });
      options.onFire?.();
      if (options.fail !== undefined) {
        throw options.fail;
      }
      return undefined;
    },
    describeError: (e) => `실패: ${String((e as Error)?.message ?? e)}`,
    groupId: options.groupId ?? GROUP_ID,
    removing: options.removing ?? false,
    setRemoving: (next) => rec.progress.push(next),
    setRemoveError: (next) => rec.errors.push(next),
    bumpRefresh: () => {
      rec.refreshCount += 1;
    },
  };
}

// runAdd 용 deps 조립 — RemoveDeps mirror + resetInput(성공 시 입력 초기화) 관측.
function makeAddDeps(
  rec: Recorder,
  options: {
    adding?: boolean;
    groupId?: string;
    fail?: unknown;
    onFire?: () => void;
  } = {},
): AddDeps {
  return {
    add: async (path, requestOptions) => {
      rec.fires.push({ path, options: requestOptions });
      options.onFire?.();
      if (options.fail !== undefined) {
        throw options.fail;
      }
      return undefined;
    },
    describeError: (e) => `실패: ${String((e as Error)?.message ?? e)}`,
    groupId: options.groupId ?? GROUP_ID,
    adding: options.adding ?? false,
    setAdding: (next) => rec.progress.push(next),
    setAddError: (next) => rec.errors.push(next),
    bumpRefresh: () => {
      rec.refreshCount += 1;
    },
    resetInput: () => {
      rec.resetCount += 1;
    },
  };
}

describe('adminMembershipRunners 모듈 공개 표면', () => {
  // 이동이 사본을 만들지 않았음의 박제 — 배럴 재수출본과 직접 import 본이 같은 함수 객체여야
  // 기존 계약 spec(`from './AdminView'`)의 단언이 새 모듈의 동작을 계속 검증한다.
  it('AdminView 배럴 재수출본이 새 모듈의 심볼과 동일 참조다', () => {
    expect(reexportedRunRemove).toBe(runRemove);
    expect(reexportedRunAdd).toBe(runAdd);
  });

  it('러너 2 종이 새 모듈에서 직접 import 되는 함수다', () => {
    expect(typeof runRemove).toBe('function');
    expect(typeof runAdd).toBe('function');
  });
});

describe('runRemove — 멤버 제거 DELETE 러너', () => {
  // happy path — path · method · 성공 후 재조회 트리거.
  it('정상 호출 시 DELETE /api/groups/:id/members/:membershipId 를 발사하고 재조회를 트리거한다', async () => {
    const rec = newRecorder();
    await runRemove(MEMBERSHIP_ID, makeRemoveDeps(rec));

    expect(rec.fires).toHaveLength(1);
    expect(rec.fires[0].path).toBe(
      `/api/groups/${GROUP_ID}/members/${MEMBERSHIP_ID}`,
    );
    expect(rec.fires[0].options.method).toBe('DELETE');
    expect(rec.refreshCount).toBe(1);
    // 재발화 시작 시 직전 error 를 비운다 — 성공 경로에서 error 표면화는 없다.
    expect(rec.errors).toEqual([undefined]);
  });

  // finally 경로(성공) — 진행 플래그가 on → off 로 복귀.
  it('성공 경로에서 진행 플래그가 on 후 off 로 복귀한다', async () => {
    const rec = newRecorder();
    await runRemove(MEMBERSHIP_ID, makeRemoveDeps(rec));
    expect(rec.progress).toEqual([true, false]);
  });

  // error path — throw 가 밖으로 새지 않고 describeError 파생 문구가 표면화된다.
  it('발사 primitive 가 throw 하면 예외를 삼키고 실패 문구를 표면화한다', async () => {
    const rec = newRecorder();
    await expect(
      runRemove(
        MEMBERSHIP_ID,
        makeRemoveDeps(rec, { fail: new Error('404 없음') }),
      ),
    ).resolves.toBeUndefined();

    expect(rec.errors).toEqual([undefined, '실패: 404 없음']);
    // 실패 시 재조회 nonce 는 bump 하지 않는다(목록 그대로 유지).
    expect(rec.refreshCount).toBe(0);
  });

  // finally 경로(실패) — 실패해도 진행 플래그가 off 로 복귀해야 재시도가 가능하다.
  it('실패 경로에서도 진행 플래그가 off 로 복귀한다', async () => {
    const rec = newRecorder();
    await runRemove(
      MEMBERSHIP_ID,
      makeRemoveDeps(rec, { fail: new Error('boom') }),
    );
    expect(rec.progress).toEqual([true, false]);
  });

  // 분기 (a) — 빈 membershipId 미발사.
  it('빈 membershipId 면 발사하지 않고 상태도 건드리지 않는다', async () => {
    const rec = newRecorder();
    await runRemove('', makeRemoveDeps(rec));

    expect(rec.fires).toHaveLength(0);
    expect(rec.progress).toEqual([]);
    expect(rec.errors).toEqual([]);
    expect(rec.refreshCount).toBe(0);
  });

  // 분기 (b) — in-flight 가드.
  it('removing 이 true 면(이전 mutation 미완) 발사하지 않는다', async () => {
    const rec = newRecorder();
    await runRemove(MEMBERSHIP_ID, makeRemoveDeps(rec, { removing: true }));

    expect(rec.fires).toHaveLength(0);
    expect(rec.progress).toEqual([]);
  });

  // negative — in-flight 중복 호출: 두 번째 호출이 이중 DELETE 를 만들지 않는다.
  it('in-flight 중 재호출해도 이중 DELETE 가 발생하지 않는다', async () => {
    const rec = newRecorder();
    // 첫 호출은 정상 발사, 두 번째는 removing=true 로 주입해 가드가 막는지 본다.
    await runRemove(MEMBERSHIP_ID, makeRemoveDeps(rec));
    await runRemove(MEMBERSHIP_ID, makeRemoveDeps(rec, { removing: true }));

    expect(rec.fires).toHaveLength(1);
  });

  // negative — 비정상 문자가 든 id 의 안전 인코딩(path 가 깨지지 않아야 한다).
  it('비정상 문자가 든 groupId · membershipId 를 encodeURIComponent 로 안전 인코딩한다', async () => {
    const rec = newRecorder();
    await runRemove('m /1?x', makeRemoveDeps(rec, { groupId: 'g#1&2' }));

    expect(rec.fires[0].path).toBe('/api/groups/g%231%262/members/m%20%2F1%3Fx');
  });

  // negative — 발사 primitive 가 비-Error 를 reject 해도 문구 파생 경로가 산다.
  it('비-Error 값을 reject 해도 실패 문구를 파생해 표면화한다', async () => {
    const rec = newRecorder();
    await runRemove(MEMBERSHIP_ID, makeRemoveDeps(rec, { fail: 'string 거부' }));

    expect(rec.errors[1]).toContain('string 거부');
    expect(rec.refreshCount).toBe(0);
  });
});

describe('runAdd — 멤버 추가 POST 러너', () => {
  // happy path — path · method · body · 성공 후 재조회 + 입력 초기화.
  it('정상 호출 시 POST /api/groups/:id/members 를 personId body 로 발사한다', async () => {
    const rec = newRecorder();
    await runAdd(PERSON_ID, makeAddDeps(rec));

    expect(rec.fires).toHaveLength(1);
    expect(rec.fires[0].path).toBe(`/api/groups/${GROUP_ID}/members`);
    expect(rec.fires[0].options.method).toBe('POST');
    expect(rec.fires[0].options.body).toBe(
      JSON.stringify({ personId: PERSON_ID }),
    );
    expect(rec.refreshCount).toBe(1);
    expect(rec.resetCount).toBe(1);
  });

  // finally 경로(성공).
  it('성공 경로에서 진행 플래그가 on 후 off 로 복귀한다', async () => {
    const rec = newRecorder();
    await runAdd(PERSON_ID, makeAddDeps(rec));
    expect(rec.progress).toEqual([true, false]);
  });

  // error path — throw 를 삼키고 문구 표면화 + 재조회 미발생.
  it('발사 primitive 가 throw 하면 예외를 삼키고 실패 문구를 표면화한다', async () => {
    const rec = newRecorder();
    await expect(
      runAdd(PERSON_ID, makeAddDeps(rec, { fail: new Error('409 중복') })),
    ).resolves.toBeUndefined();

    expect(rec.errors).toEqual([undefined, '실패: 409 중복']);
    expect(rec.refreshCount).toBe(0);
  });

  // negative (f) — 실패 후 입력 초기화가 일어나지 않는다(입력 유지).
  it('실패 시 resetInput 을 호출하지 않아 입력이 유지된다', async () => {
    const rec = newRecorder();
    await runAdd(PERSON_ID, makeAddDeps(rec, { fail: new Error('boom') }));

    expect(rec.resetCount).toBe(0);
    expect(rec.refreshCount).toBe(0);
  });

  // finally 경로(실패).
  it('실패 경로에서도 진행 플래그가 off 로 복귀한다', async () => {
    const rec = newRecorder();
    await runAdd(PERSON_ID, makeAddDeps(rec, { fail: new Error('boom') }));
    expect(rec.progress).toEqual([true, false]);
  });

  // 분기 (a) — 빈 personId 미발사.
  it('빈 personId 면 발사하지 않는다', async () => {
    const rec = newRecorder();
    await runAdd('', makeAddDeps(rec));

    expect(rec.fires).toHaveLength(0);
    expect(rec.progress).toEqual([]);
  });

  // 분기 (b) / negative (b) — 공백만 입력은 trim 후 억제된다.
  it('공백만 든 personId 는 trim 후 발사하지 않는다', async () => {
    const rec = newRecorder();
    await runAdd('   ', makeAddDeps(rec));

    expect(rec.fires).toHaveLength(0);
    expect(rec.errors).toEqual([]);
  });

  // trim 경로의 반대편 — 앞뒤 공백이 있어도 값이 있으면 trim 된 값으로 발사한다.
  it('앞뒤 공백이 있는 personId 는 trim 된 값으로 발사한다', async () => {
    const rec = newRecorder();
    await runAdd(`  ${PERSON_ID}  `, makeAddDeps(rec));

    expect(rec.fires[0].options.body).toBe(
      JSON.stringify({ personId: PERSON_ID }),
    );
  });

  // 분기 (c) — 그룹 미선택 가드.
  it('groupId 가 비면 발사하지 않는다', async () => {
    const rec = newRecorder();
    await runAdd(PERSON_ID, makeAddDeps(rec, { groupId: '' }));

    expect(rec.fires).toHaveLength(0);
    expect(rec.progress).toEqual([]);
  });

  // 분기 (d) — in-flight 가드.
  it('adding 이 true 면(이전 mutation 미완) 발사하지 않는다', async () => {
    const rec = newRecorder();
    await runAdd(PERSON_ID, makeAddDeps(rec, { adding: true }));

    expect(rec.fires).toHaveLength(0);
  });

  // negative (c) — in-flight 중복 호출로 이중 POST 가 생기지 않는다.
  it('in-flight 중 재호출해도 이중 POST 가 발생하지 않는다', async () => {
    const rec = newRecorder();
    await runAdd(PERSON_ID, makeAddDeps(rec));
    await runAdd(PERSON_ID, makeAddDeps(rec, { adding: true }));

    expect(rec.fires).toHaveLength(1);
  });

  // negative (d) — 비정상 문자가 든 groupId 안전 인코딩.
  it('비정상 문자가 든 groupId 를 encodeURIComponent 로 안전 인코딩한다', async () => {
    const rec = newRecorder();
    await runAdd(PERSON_ID, makeAddDeps(rec, { groupId: 'g /1?x' }));

    expect(rec.fires[0].path).toBe('/api/groups/g%20%2F1%3Fx/members');
  });

  // negative — Content-Type 헤더가 JSON body 발사 convention 을 지킨다.
  it('JSON body 발사 시 Content-Type 헤더를 함께 보낸다', async () => {
    const rec = newRecorder();
    await runAdd(PERSON_ID, makeAddDeps(rec));

    expect(rec.fires[0].options.headers).toEqual({
      'Content-Type': 'application/json',
    });
  });

  // negative — null/undefined 가 들어와도(타입 우회 호출) optional chain 으로 안전 억제된다.
  it('undefined personId 로 우회 호출해도 throw 없이 미발사로 끝난다', async () => {
    const rec = newRecorder();
    await expect(
      runAdd(undefined as unknown as string, makeAddDeps(rec)),
    ).resolves.toBeUndefined();

    expect(rec.fires).toHaveLength(0);
  });
});
