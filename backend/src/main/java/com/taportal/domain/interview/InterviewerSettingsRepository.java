package com.taportal.domain.interview;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewerSettingsRepository extends JpaRepository<InterviewerSettings, UUID> {

    List<InterviewerSettings> findByUserIdIn(List<UUID> userIds);
}
