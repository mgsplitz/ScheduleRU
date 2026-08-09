/*
 * Pure Core-credit allocation. Callers provide requirement data, completion
 * evidence, and school policy; this module owns only generic slot construction
 * and maximum bipartite matching.
 */
(function exposeCoreAllocationModel(root) {
  function create({
    getGroups,
    getRootGroupIds,
    isCourseCompleted,
    getSelectedApAwards,
    courseCodesFromText,
    requirementCourseId,
    isApAllowedForGroup,
  } = {}) {
    function groups() {
      return getGroups?.() || {};
    }

    function groupNeeded(group) {
      return group?.rule === "min" || group?.rule === "distinct"
        ? Math.max(1, Number(group.count) || 1)
        : 0;
    }

    function requirementGroupIds(rootId) {
      const currentGroups = groups();
      const result = [];
      function visit(groupId) {
        const group = currentGroups[groupId];
        if (!group) return;
        if (group.rule === "distinct" || (group.rule !== "all" && (group.members || []).length)) {
          result.push(groupId);
          return;
        }
        (group.children || []).forEach(visit);
      }
      visit(rootId);
      return result;
    }

    function completionTokens() {
      const currentGroups = groups();
      const coreIds = new Set(
        Object.values(currentGroups).flatMap((group) => group.members || []),
      );
      const tokens = [];

      [...coreIds].filter((id) => isCourseCompleted?.(id)).sort().forEach((id) => {
        tokens.push({
          key: `course:${id}`,
          kind: "course",
          courseIds: new Set([id]),
          courseId: id,
        });
      });

      (getSelectedApAwards?.() || []).forEach((award) => {
        const equivalentIds = new Set([
          ...(courseCodesFromText?.(award.equiv) || []).map(requirementCourseId),
          ...(award.fulfills || []),
        ]);
        const courseIds = [...coreIds].filter((id) => equivalentIds.has(id));
        if (courseIds.length) {
          tokens.push({
            key: `ap:${award.id}`,
            kind: "ap",
            ap: award,
            courseIds: new Set(courseIds),
          });
        }
      });
      return tokens;
    }

    function chooseGroups(items, size, start = 0, picked = [], output = []) {
      if (picked.length === size) {
        output.push([...picked]);
        return output;
      }
      for (let index = start; index <= items.length - (size - picked.length); index += 1) {
        picked.push(items[index]);
        chooseGroups(items, size, index + 1, picked, output);
        picked.pop();
      }
      return output;
    }

    function slotVariants(rootId) {
      const currentGroups = groups();
      const fixed = [];
      let variants = [[]];

      requirementGroupIds(rootId).forEach((groupId) => {
        const group = currentGroups[groupId];
        if (group.rule === "distinct") {
          const children = (group.children || [])
            .map((id) => currentGroups[id])
            .filter((child) => (child?.members || []).length);
          const choices = [[]];
          for (let count = 1; count <= Math.min(groupNeeded(group), children.length); count += 1) {
            chooseGroups(children, count).forEach((subset) => {
              choices.push(subset.map((child) => ({
                groupId: group.id,
                subgroupId: child.id,
                courseIds: new Set(child.members || []),
                apAllowed: isApAllowedForGroup?.(group) !== false,
              })));
            });
          }
          variants = variants.flatMap((base) =>
            choices.map((choice) => [...base, ...choice]));
          return;
        }
        for (let count = 0; count < groupNeeded(group); count += 1) {
          fixed.push({
            groupId: group.id,
            courseIds: new Set(group.members || []),
            apAllowed: isApAllowedForGroup?.(group) !== false,
          });
        }
      });

      return variants.map((variant) => [...fixed, ...variant].map((slot, index) => ({
        ...slot,
        key: `${rootId}:${slot.groupId}:${index}`,
      })));
    }

    function maximumMatching(slots, tokens) {
      const tokenByKey = new Map(tokens.map((token) => [token.key, token]));
      const candidates = new Map(slots.map((slot) => [
        slot.key,
        tokens.filter((token) =>
          (token.kind !== "ap" || slot.apAllowed)
          && [...slot.courseIds].some((id) => token.courseIds.has(id)))
          .map((token) => token.key),
      ]));
      const tokenToSlot = new Map();
      const slotByKey = new Map(slots.map((slot) => [slot.key, slot]));

      function place(slotKey, seenTokens) {
        for (const tokenKey of candidates.get(slotKey) || []) {
          if (seenTokens.has(tokenKey)) continue;
          seenTokens.add(tokenKey);
          const previous = tokenToSlot.get(tokenKey);
          if (previous === undefined || place(previous, seenTokens)) {
            tokenToSlot.set(tokenKey, slotKey);
            return true;
          }
        }
        return false;
      }

      [...slots]
        .sort((left, right) =>
          (candidates.get(left.key) || []).length - (candidates.get(right.key) || []).length)
        .forEach((slot) => place(slot.key, new Set()));

      return [...tokenToSlot.entries()].map(([tokenKey, slotKey]) => ({
        token: tokenByKey.get(tokenKey),
        slot: slotByKey.get(slotKey),
      }));
    }

    function allocate() {
      const tokens = completionTokens();
      const byGroup = {};
      (getRootGroupIds?.() || []).forEach((rootId) => {
        let best = [];
        slotVariants(rootId).forEach((slots) => {
          const matches = maximumMatching(slots, tokens);
          if (matches.length > best.length) best = matches;
        });
        best.forEach(({ slot, token }) => {
          (byGroup[slot.groupId] ||= []).push(token);
          if (slot.subgroupId) (byGroup[slot.subgroupId] ||= []).push(token);
        });
      });
      return { tokens, byGroup };
    }

    return {
      groupNeeded,
      requirementGroupIds,
      completionTokens,
      slotVariants,
      maximumMatching,
      allocate,
    };
  }

  root.ScheduleRUCoreAllocationModel = { create };
})(globalThis);
