package com.taportal.domain.interview;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewerWeeklyRuleRepository extends JpaRepository<InterviewerWeeklyRule, UUID> {

    List<InterviewerWeeklyRule> findByUserIdIn(List<UUID> userIds);

    List<InterviewerWeeklyRule> findByUserIdOrderByDayOfWeekAscStartTimeAsc(UUID userId);
}
