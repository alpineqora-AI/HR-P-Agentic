package com.taportal.domain.interview;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewRoundRepository extends JpaRepository<InterviewRound, UUID> {

    List<InterviewRound> findByJobIdOrderByRoundNo(UUID jobId);

    int countByJobId(UUID jobId);
}
