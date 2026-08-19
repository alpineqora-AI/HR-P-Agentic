package com.taportal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * TA Portal — a conversational, best-in-class talent-acquisition platform (POC).
 *
 * <p>Builds the full recruiting funnel as a composite of the category leaders studied in the
 * feature matrix: conversational apply &amp; automation (Paradox), personalized career sites
 * (Phenom), talent intelligence / skills graph (Eightfold), AI interviewing (Humanly), video
 * &amp; assessments (HireVue), and engagement / copilot / voice (Sense).
 */
@SpringBootApplication
@EnableScheduling
public class TaPortalApplication {

    public static void main(String[] args) {
        SpringApplication.run(TaPortalApplication.class, args);
    }
}
